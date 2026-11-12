import { Query, Resolver } from '@nestjs/graphql';
import { ExperienceModel } from './experience.model.js';
import { ExperienceService } from './experience.service.js';

@Resolver(() => ExperienceModel)
export class ExperienceResolver {
  constructor(private readonly experienceService: ExperienceService) {}

  @Query(() => [ExperienceModel], {
    description: 'Work experience on the business card, ordered for display.',
  })
  experience(): Promise<ExperienceModel[]> {
    return this.experienceService.list();
  }
}
