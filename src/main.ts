import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get(ConfigService<EnvironmentVariables, true>);
  await app.listen(config.getOrThrow('PORT', { infer: true }));
}

await bootstrap();
