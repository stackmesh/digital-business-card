import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ProfileResolver } from './profile.resolver.js';
import { ProfileService } from './profile.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ProfileService, ProfileResolver],
})
export class ProfileModule {}
