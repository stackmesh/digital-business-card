import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsResolver } from './projects.resolver.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ProjectsService, ProjectsResolver],
})
export class ProjectsModule {}
