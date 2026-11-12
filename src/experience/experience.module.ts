import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ExperienceResolver } from './experience.resolver.js';
import { ExperienceService } from './experience.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ExperienceService, ExperienceResolver],
})
export class ExperienceModule {}
