import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/database/prisma.service.js';

export async function createApplication(
  prisma: PrismaClient,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const application = moduleRef.createNestApplication();
  await application.init();
  return application;
}
