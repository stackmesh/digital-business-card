import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { SkillsResolver } from './skills.resolver.js';
import { SkillsService } from './skills.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [SkillsService, SkillsResolver],
})
export class SkillsModule {}
