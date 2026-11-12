import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { GraphqlModule } from './graphql/graphql.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    GraphqlModule,
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
