import { Query, Resolver } from '@nestjs/graphql';
import { ProfileModel } from './profile.model.js';
import { ProfileService } from './profile.service.js';

@Resolver(() => ProfileModel)
export class ProfileResolver {
  constructor(private readonly profileService: ProfileService) {}

  @Query(() => ProfileModel, {
    nullable: true,
    description:
      'The canonical business card, or null when it has not been created.',
  })
  profile(): Promise<ProfileModel | null> {
    return this.profileService.getProfile();
  }
}
